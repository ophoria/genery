"""Local inference only. stdout is a JSON-line protocol; diagnostics go to stderr."""
import contextlib
import csv
import json
import os
from pathlib import Path
import sys
import time
import traceback

HOME = Path(os.environ['GENERY_AI_HOME'])
PREFIX = '@@GENERY@@'
REPOS = {
    'wd-swinv2': 'SmilingWolf/wd-swinv2-tagger-v3',
    'wd-eva02': 'SmilingWolf/wd-eva02-large-tagger-v3',
    'siglip-base': 'google/siglip2-base-patch16-224',
    'siglip-so400m': 'google/siglip2-so400m-patch14-384',
}


def emit(value):
    print(PREFIX + json.dumps(value, allow_nan=False), flush=True)


def manifest_path(variant):
    return HOME / 'models' / (variant + '.json')


def download(variant):
    from huggingface_hub import hf_hub_download, snapshot_download
    emit({'type': 'progress', 'message': 'Downloading model weights. This can take several minutes…'})
    if variant.startswith('wd-'):
        folder = snapshot_download(REPOS[variant], allow_patterns=['model.onnx', 'selected_tags.csv'])
        return {'path': folder}
    if variant.startswith('siglip-'):
        folder = snapshot_download(REPOS[variant], allow_patterns=['*.json', '*.safetensors', '*.model', '*.txt'])
        return {'path': folder}
    if variant == 'ram-plus':
        checkpoint = hf_hub_download('xinyu1205/recognize-anything-plus-model', 'ram_plus_swin_large_14m.pth')
    else:
        checkpoint = hf_hub_download('xinyu1205/Recognize_Anything-Tag2Text', 'ram_swin_large_14m.pth', repo_type='space')
    tokenizer = snapshot_download('google-bert/bert-base-uncased', allow_patterns=['vocab.txt', 'tokenizer*.json', 'config.json'])
    return {'path': checkpoint, 'tokenizer': tokenizer}


def choose_device(preference):
    import torch
    if preference == 'mps' and not torch.backends.mps.is_available():
        raise RuntimeError('Apple GPU is unavailable in this runtime. Choose CPU or Automatic.')
    return 'mps' if preference != 'cpu' and torch.backends.mps.is_available() else 'cpu'


def open_image(file):
    from PIL import Image, ImageOps
    with Image.open(file) as original:
        original.seek(0)
        image = ImageOps.exif_transpose(original).convert('RGBA')
        background = Image.new('RGBA', image.size, 'white')
        background.alpha_composite(image)
        return background.convert('RGB')


class Engine:
    def __init__(self, variant, settings, manifest):
        self.variant = variant
        self.settings = settings
        self.device = 'cpu'
        self.model = None
        if variant.startswith('wd-'):
            import onnxruntime as ort
            self.model = ort.InferenceSession(str(Path(manifest['path']) / 'model.onnx'), providers=['CPUExecutionProvider'])
            with open(Path(manifest['path']) / 'selected_tags.csv', newline='', encoding='utf-8') as f:
                self.tags = list(csv.DictReader(f))
        elif variant.startswith('siglip-'):
            import torch
            from transformers import AutoModel, AutoProcessor
            self.device = choose_device(settings['device'])
            self.model = AutoModel.from_pretrained(manifest['path'], local_files_only=True).eval().to(self.device)
            self.processor = AutoProcessor.from_pretrained(manifest['path'], local_files_only=True)
            self.labels = settings['siglipLabels']
            descriptions = [settings['siglipTemplate'].replace('{}', row['description']) for row in self.labels]
            tokens = self.processor(text=descriptions, padding='max_length', max_length=self.model.config.text_config.max_position_embeddings, truncation=True, return_tensors='pt')
            tokens = {k: v.to(self.device) for k, v in tokens.items() if k in ('input_ids', 'attention_mask')}
            with torch.inference_mode():
                self.text_features = self.model.get_text_features(**tokens)
                self.text_features = self.text_features / self.text_features.norm(dim=-1, keepdim=True)
        else:
            import torch
            sys.path.insert(0, str(HOME / 'ram-source'))
            from ram.models import ram, ram_plus
            from ram import get_transform
            self.device = choose_device(settings['device'])
            factory = ram_plus if variant == 'ram-plus' else ram
            self.model = factory(pretrained=manifest['path'], image_size=384, vit='swin_l', text_encoder_type=manifest['tokenizer']).eval().to(self.device)
            if not settings['ramUseModelThresholds']:
                self.model.class_threshold.fill_(settings['threshold'])
            self.transform = get_transform(image_size=384)
            self.logits = None
            self.model.fc.register_forward_hook(self.capture_logits)

    def capture_logits(self, module, inputs, output):
        self.logits = output.detach()

    def infer(self, file):
        import numpy as np
        started = time.monotonic()
        image = open_image(file)
        s = self.settings
        excluded = {label.lower().replace('_', ' ').strip() for label in s['excludedTags']}
        output = []
        if self.variant.startswith('wd-'):
            from PIL import Image
            _, height, width, _ = self.model.get_inputs()[0].shape
            canvas_size = max(image.size)
            canvas = Image.new('RGB', (canvas_size, canvas_size), 'white')
            canvas.paste(image, ((canvas_size - image.width) // 2, (canvas_size - image.height) // 2))
            pixels = np.asarray(canvas.resize((width, height), Image.Resampling.BICUBIC), dtype=np.float32)[:, :, ::-1]
            scores = self.model.run(None, {self.model.get_inputs()[0].name: pixels[None, ...]})[0][0]
            for row, score in zip(self.tags, scores):
                category = int(row['category'])
                group = 'rating' if category == 9 else 'character' if category == 4 else 'general'
                if group == 'character' and not s['wdIncludeCharacters']:
                    continue
                if group == 'rating' and not s['wdIncludeRatings']:
                    continue
                threshold = s['wdCharacterThreshold'] if group == 'character' else s['threshold']
                if float(score) >= threshold:
                    output.append({'label': row['name'].replace('_', ' '), 'group': group, 'score': float(score)})
        elif self.variant.startswith('siglip-'):
            import torch
            inputs = self.processor(images=image, return_tensors='pt')
            with torch.inference_mode():
                features = self.model.get_image_features(pixel_values=inputs['pixel_values'].to(self.device))
                features = features / features.norm(dim=-1, keepdim=True)
                logits = features @ self.text_features.T * self.model.logit_scale.exp() + self.model.logit_bias
                scores = logits.sigmoid()[0].cpu().numpy()
            grouped = {}
            for row, score in zip(self.labels, scores):
                if float(score) >= s['threshold'] and row['label'].lower() not in excluded:
                    grouped.setdefault(row['group'], []).append({**{k: row[k] for k in ('label', 'group')}, 'score': float(score)})
            for tags in grouped.values():
                output.extend(sorted(tags, key=lambda tag: -tag['score'])[:s['siglipTopPerGroup']])
        else:
            import torch
            tensor = self.transform(image).unsqueeze(0).to(self.device)
            with torch.inference_mode():
                self.model.generate_tag(tensor)
                scores = self.logits.squeeze().sigmoid().cpu().numpy()
            thresholds = self.model.class_threshold.cpu().numpy()
            for label, score, threshold in zip(self.model.tag_list, scores, thresholds):
                if float(score) >= float(threshold):
                    output.append({'label': str(label), 'group': 'motif', 'score': float(score)})
        output = [t for t in output if t['label'].lower().replace('_', ' ').strip() not in excluded]
        output = sorted(output, key=lambda tag: -tag['score'])[:s['maxTags']]
        return {'tags': output, 'device': self.device, 'durationMs': round((time.monotonic() - started) * 1000)}


def main():
    variant = sys.argv[2]
    prepare = sys.argv[1] == '--prepare'
    if prepare:
        manifest = download(variant)
        # Persist paths only after the weights successfully load.
        defaults = json.loads(sys.stdin.readline())
        emit({'type': 'progress', 'message': 'Checking the downloaded model…'})
        with contextlib.redirect_stdout(sys.stderr):
            engine = Engine(variant, defaults, manifest)
            # A real inference catches provider/operator incompatibilities during setup.
            from PIL import Image
            test_file = HOME / 'setup-check.png'
            Image.new('RGB', (64, 64), 'white').save(test_file)
            engine.infer(test_file)
            test_file.unlink(missing_ok=True)
        manifest_path(variant).parent.mkdir(parents=True, exist_ok=True)
        temp = manifest_path(variant).with_suffix('.tmp')
        temp.write_text(json.dumps(manifest))
        temp.replace(manifest_path(variant))
        emit({'type': 'ready', 'device': engine.device})
        return
    manifest = json.loads(manifest_path(variant).read_text())
    settings = json.loads(sys.stdin.readline())
    emit({'type': 'progress', 'message': 'Loading model into memory…'})
    with contextlib.redirect_stdout(sys.stderr):
        engine = Engine(variant, settings, manifest)
    emit({'type': 'ready', 'device': engine.device})
    for line in sys.stdin:
        request = json.loads(line)
        try:
            with contextlib.redirect_stdout(sys.stderr):
                result = engine.infer(request['path'])
            emit({'type': 'result', 'id': request['id'], **result})
        except Exception as error:
            traceback.print_exc(file=sys.stderr)
            emit({'type': 'error', 'id': request['id'], 'error': str(error)})


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        traceback.print_exc(file=sys.stderr)
        emit({'type': 'fatal', 'error': str(error)})
        sys.exit(1)

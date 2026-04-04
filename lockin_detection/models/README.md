# Models

This folder holds pre-trained `.task` files used by the MediaPipe Tasks API.
These are binary model bundles (weights + metadata) downloaded once from Google's model zoo and committed to the repo — you do not train them yourself.

## Files

### `efficientdet_lite0.task`
- **Purpose**: Object detection — used to detect a cell phone in the camera frame
- **Architecture**: EfficientDet Lite 0 (TFLite), trained on the COCO dataset (80 everyday object classes)
- **Relevant class**: `"cell phone"` (COCO class 67)
- **Size**: ~13 MB
- **Used by**: `faceService.py` → `_try_load_phone_detector()`
- **Score threshold**: 0.4 (configurable)

**Download:**
```
https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float32/latest/efficientdet_lite0.task
```

## Why `.task` files?

The newer MediaPipe Tasks API (used for object detection) requires an explicit model file loaded by path at runtime. This is different from the classic `mp.solutions.*` API (used for FaceMesh) which bundles its own weights inside the `mediapipe` pip package and needs no file here.

If additional detectors are added in the future (e.g. gesture recognition, pose estimation), their `.task` files would also live in this folder.

## Notes

- Phone detection is **optional** — `faceService.py` will silently skip it and fall back to gaze-only detection if this file is absent
- Do not rename the file; `faceService.py` references `efficientdet_lite0.task` by name
- `.task` files are large binary assets — consider adding them to `.gitignore` and providing the download URL instead of committing them directly

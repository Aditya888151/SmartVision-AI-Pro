import cv2
import numpy as np
import base64

# Create a simple 200x200 test image with some patterns
img = np.zeros((200, 200, 3), dtype=np.uint8)

# Add some face-like patterns
cv2.rectangle(img, (50, 50), (150, 150), (100, 100, 100), -1)  # Face area
cv2.circle(img, (80, 80), 10, (255, 255, 255), -1)  # Left eye
cv2.circle(img, (120, 80), 10, (255, 255, 255), -1)  # Right eye
cv2.rectangle(img, (90, 110), (110, 120), (200, 200, 200), -1)  # Nose
cv2.rectangle(img, (80, 130), (120, 140), (150, 150, 150), -1)  # Mouth

# Encode to base64
_, buffer = cv2.imencode('.jpg', img)
img_base64 = base64.b64encode(buffer).decode('utf-8')

print(f"data:image/jpeg;base64,{img_base64}")
import google.generativeai as genai
import os
from config import settings # Import your settings to get the API key

# Configure the API key
genai.configure(api_key=settings.GEMINI_API_KEY)

print("Fetching available models...\n")

# List all models
for m in genai.list_models():
  # Check if the model supports the 'generateContent' method
  if 'generateContent' in m.supported_generation_methods:
    print(f"Model found: {m.name}")

print("\n...Finished fetching models.")

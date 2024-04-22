import json
import os
from flask import current_app as app


def load_data(file_name):
    file_path = os.path.join(app.root_path, 'data', file_name)
    try:
        with open(file_path, 'r', encoding='utf-8') as file:
            data = json.load(file)
        # print("Data loaded successfully:", data)  # Debugging line
        return data
    except FileNotFoundError as e:
        print(f"File not found: {e}")
        return []  # Ensure it returns a list if expected to iterate over it


def save_data(data, file_name):
    """Save data to a JSON file located in the app/data directory."""
    file_path = os.path.join(app.root_path, 'data', file_name)
    with open(file_path, 'w', encoding='utf-8') as file:
        json.dump(data, file, indent=4)

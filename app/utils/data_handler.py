import json
import os
from flask import current_app as app


def load_data(file_name):
    """Load data from a JSON file located in the app/data directory."""
    # Adjusted file_path to reflect the new data directory location
    file_path = os.path.join(app.root_path, 'data', file_name)
    try:
        with open(file_path, 'r', encoding='utf-8') as file:
            data = json.load(file)
        return data
    except FileNotFoundError as e:
        # Optionally, log the error or handle it as per your application's requirements
        print(f"File not found: {e}")
        return {}  # or appropriate fallback value like [], depending on your expected data structure


def save_data(data, file_name):
    """Save data to a JSON file located in the app/data directory."""
    file_path = os.path.join(app.root_path, 'data', file_name)
    with open(file_path, 'w', encoding='utf-8') as file:
        json.dump(data, file, indent=4)

from flask import Flask
from flask_cors import CORS


def create_app():
    app = Flask(__name__)

    # Configuration setup
    app.config['SECRET_KEY'] = 'your_secret_key_here'
    app.config['CORS_HEADERS'] = 'Content-Type'

    # Allow all domains on all routes
    CORS(app, resources={r"/*": {"origins": "*"}})

    # Import and register blueprints
    from .views.main import main_bp
    app.register_blueprint(main_bp)

    return app

from flask import Flask


def create_app():
    app = Flask(__name__)

    # Configuration setup
    app.config['SECRET_KEY'] = 'your_secret_key_here'

    # Import and register blueprints
    from .views.main import main_bp
    app.register_blueprint(main_bp)

    return app

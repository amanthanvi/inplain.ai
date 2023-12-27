from flask import Flask
from .database import db, migrate
from flask_login import LoginManager
import os
from dotenv import load_dotenv

load_dotenv()

def create_app():
    app = Flask(__name__)
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///mydatabase.db'
    app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY')
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

    db.init_app(app)
    migrate.init_app(app, db)
    
    login_manager = LoginManager()
    login_manager.login_view = 'auth_bp.login'
    login_manager.init_app(app)

    @login_manager.user_loader
    def load_user(user_id):
        from .models import User
        return User.query.get(int(user_id))

    # Import and register blueprints
    from .routes.main_routes import main_bp
    from .routes.company_routes import company_bp
    from .routes.product_routes import product_bp
    from .routes.policy_document_routes import policy_document_bp
    from .routes.policy_change_routes import policy_change_bp
    from .routes.auth_routes import auth_bp
    
    app.register_blueprint(main_bp)
    app.register_blueprint(company_bp)
    app.register_blueprint(product_bp)
    app.register_blueprint(policy_document_bp)
    app.register_blueprint(policy_change_bp)
    app.register_blueprint(auth_bp)

    return app

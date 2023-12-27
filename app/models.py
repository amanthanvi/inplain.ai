from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
from datetime import datetime
from .database import db

class Company(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)
    website = db.Column(db.String(100))
    products = db.relationship('Product', backref='company', lazy=True)

class Product(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)
    company_id = db.Column(db.Integer, db.ForeignKey('company.id'))
    policy_documents = db.relationship('PolicyDocument', backref='product', lazy=True)

class PolicyDocument(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    content = db.Column(db.Text, nullable=False)
    summary = db.Column(db.Text)
    product_id = db.Column(db.Integer, db.ForeignKey('product.id'))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, onupdate=datetime.utcnow)
    changes = db.relationship('PolicyChange', backref='policy_document', lazy=True)

class PolicyChange(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    policy_document_id = db.Column(db.Integer, db.ForeignKey('policy_document.id'))
    previous_version = db.Column(db.Text)
    new_version = db.Column(db.Text)
    change_summary = db.Column(db.Text)
    changed_at = db.Column(db.DateTime, default=datetime.utcnow)

class User(db.Model, UserMixin):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(100), nullable=False, unique=True)
    email = db.Column(db.String(100), nullable=False, unique=True)
    password_hash = db.Column(db.String(200))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, onupdate=datetime.utcnow)

    # Flask-Login integration
    def get_id(self):
        return (self.id)
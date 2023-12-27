from flask import Blueprint, request, render_template, redirect, url_for, flash
from flask_login import login_user, logout_user, login_required, current_user
from werkzeug.security import generate_password_hash, check_password_hash
from app.models import User, db
from datetime import datetime
import re

auth_bp = Blueprint('auth_bp', __name__)

@auth_bp.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('main_bp.index'))
    
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        user = User.query.filter_by(username=username).first()
        
        if user and check_password_hash(user.password_hash, password):
            login_user(user)
            return redirect(url_for('main_bp.index'))  # Adjust the redirect endpoint as needed
        else:
            flash('Invalid username or password')

    return render_template('login.html')  # Ensure you have a login.html template

@auth_bp.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('main_bp.index'))  # Adjust the redirect endpoint as needed

@auth_bp.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form.get('username')
        email = request.form.get('email')
        password = request.form.get('password')

        # Basic email validation
        if not re.match(r"[^@]+@[^@]+\.[^@]+", email):
            flash('Invalid email address')
            return redirect(url_for('auth_bp.register'))

        user = User.query.filter_by(username=username).first()  # Check if the user already exists
        if user:
            flash('Username already exists.')
            return redirect(url_for('auth_bp.register'))

        new_user = User(
            username=username, 
            email=email, 
            password_hash=generate_password_hash(password),
            created_at=datetime.utcnow(), 
            updated_at=datetime.utcnow()
        )
        db.session.add(new_user)
        db.session.commit()
        
        flash('Registration successful. Please log in.')
        return redirect(url_for('auth_bp.login'))

    return render_template('register.html')  # Ensure you have a register.html template

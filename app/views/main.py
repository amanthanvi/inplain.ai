from flask import Blueprint, render_template
from app.utils.data_handler import load_data
from datetime import datetime

main_bp = Blueprint('main_bp', __name__, template_folder='../templates')


def format_date(date_str):
    """ Convert string date to formatted string if not None. """
    if date_str:
        return datetime.strptime(date_str, "%Y-%m-%d").strftime('%Y-%m-%d')
    return date_str


@main_bp.route('/')
def index():
    recent_changes = load_data('changes.json')
    for change in recent_changes:
        change['changed_at'] = format_date(
            change['changed_at'])  # Format the date
    return render_template('index.html', recent_changes=recent_changes)


@main_bp.route('/company/<slug>')
def company_profile(slug):
    companies = load_data('companies.json')
    company = next((c for c in companies if c['slug'] == slug), None)
    if not company:
        return render_template('404.html'), 404
    return render_template('company_profile.html', company=company)

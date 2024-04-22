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
    companies = load_data('companies.json')
    recent_changes = []
    for company in companies:
        if 'policy_changes' in company:
            for change in company['policy_changes']:
                formatted_change = {
                    # Make sure this is correctly captured
                    'company': company['name'],
                    'company_slug': company['slug'],
                    'changed_at': format_date(change['changed_at']),
                    'summary': change['summary']
                }
                recent_changes.append(formatted_change)
    # print("Recent changes prepared for template:",
    #       recent_changes)  # Debugging line
    return render_template('index.html', recent_changes=recent_changes)


@main_bp.route('/company/<slug>')
def company_profile(slug):
    companies = load_data('companies.json')
    company = next((c for c in companies if c['slug'] == slug), None)
    if not company:
        return render_template('404.html'), 404

    # Ensure all dates in 'policy_changes' are converted to datetime objects and sorted
    if 'policy_changes' in company:
        for change in company['policy_changes']:
            # Convert 'changed_at' from string to datetime object
            change['changed_at'] = datetime.strptime(
                change['changed_at'], '%Y-%m-%d')

        # Sort the policy changes by date, in decscending order
        company['policy_changes'].sort(
            key=lambda x: x['changed_at'], reverse=True)

    return render_template('company_profile.html', company=company)

import requests


def fetch_companies(api_key, jurisdiction_code='us_ca', page=1):
    """Fetch a list of companies from OpenCorporates API."""
    url = f'https://api.opencorporates.com/v0.4/companies/search?jurisdiction_code={
        jurisdiction_code}&page={page}&api_token={api_key}'
    response = requests.get(url)
    if response.status_code == 200:
        return response.json()  # Returns the JSON response with company data
    else:
        return None


# Replace 'your_api_key_here' with your actual OpenCorporates API key
api_key = 'your_api_key_here'
companies = fetch_companies(api_key)
if companies:
    print(companies)
else:
    print("Failed to fetch companies")

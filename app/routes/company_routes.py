from flask import Blueprint, request, jsonify
from app.models import Company, db

company_bp = Blueprint('company_bp', __name__)

@company_bp.route('/companies', methods=['POST'])
def add_company():
    data = request.json
    new_company = Company(name=data['name'], description=data.get('description'), website=data.get('website'))
    db.session.add(new_company)
    db.session.commit()
    return jsonify({"message": "Company added", "id": new_company.id}), 201

@company_bp.route('/companies', methods=['GET'])
def get_companies():
    companies = Company.query.all()
    return jsonify([{"id": company.id, "name": company.name, "description": company.description, "website": company.website} for company in companies])

@company_bp.route('/companies/<int:id>', methods=['GET'])
def get_company(id):
    company = Company.query.get_or_404(id)
    return jsonify({"id": company.id, "name": company.name, "description": company.description, "website": company.website})

@company_bp.route('/companies/<int:id>', methods=['PUT'])
def update_company(id):
    company = Company.query.get_or_404(id)
    data = request.json
    company.name = data.get('name', company.name)
    company.description = data.get('description', company.description)
    company.website = data.get('website', company.website)
    db.session.commit()
    return jsonify({"message": "Company updated", "id": company.id})

@company_bp.route('/companies/<int:id>', methods=['DELETE'])
def delete_company(id):
    company = Company.query.get_or_404(id)
    db.session.delete(company)
    db.session.commit()
    return jsonify({"message": "Company deleted"})
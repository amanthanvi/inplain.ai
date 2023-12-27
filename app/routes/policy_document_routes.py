from flask import Blueprint, request, jsonify
from app.models import PolicyDocument, db 

policy_document_bp = Blueprint('policy_document_bp', __name__)

@policy_document_bp.route('/policy_documents', methods=['POST'])
def add_policy_document():
    data = request.json
    new_policy_document = PolicyDocument(content=data['content'], summary=data.get('summary'), product_id=data['product_id'])
    db.session.add(new_policy_document)
    db.session.commit()
    return jsonify({"message": "Policy document added", "id": new_policy_document.id}), 201

@policy_document_bp.route('/policy_documents', methods=['GET'])
def get_policy_documents():
    policy_documents = PolicyDocument.query.all()
    return jsonify([{"id": doc.id, "content": doc.content, "summary": doc.summary, "product_id": doc.product_id} for doc in policy_documents])

@policy_document_bp.route('/policy_documents/<int:id>', methods=['GET'])
def get_policy_document(id):
    policy_document = PolicyDocument.query.get_or_404(id)
    return jsonify({"id": policy_document.id, "content": policy_document.content, "summary": policy_document.summary, "product_id": policy_document.product_id})

@policy_document_bp.route('/policy_documents/<int:id>', methods=['PUT'])
def update_policy_document(id):
    policy_document = PolicyDocument.query.get_or_404(id)
    data = request.json
    policy_document.content = data.get('content', policy_document.content)
    policy_document.summary = data.get('summary', policy_document.summary)
    db.session.commit()
    return jsonify({"message": "Policy document updated", "id": policy_document.id})

@policy_document_bp.route('/policy_documents/<int:id>', methods=['DELETE'])
def delete_policy_document(id):
    policy_document = PolicyDocument.query.get_or_404(id)
    db.session.delete(policy_document)
    db.session.commit()
    return jsonify({"message": "Policy document deleted"})
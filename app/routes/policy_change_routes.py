from flask import Blueprint, request, jsonify
from app.models import PolicyChange, db 

policy_change_bp = Blueprint('policy_change_bp', __name__)

@policy_change_bp.route('/policy_changes', methods=['POST'])
def add_policy_change():
    data = request.json
    new_policy_change = PolicyChange(
        policy_document_id=data['policy_document_id'],
        previous_version=data['previous_version'],
        new_version=data['new_version'],
        change_summary=data['change_summary']
    )
    db.session.add(new_policy_change)
    db.session.commit()
    return jsonify({"message": "Policy change added", "id": new_policy_change.id}), 201

@policy_change_bp.route('/policy_changes/<int:id>', methods=['GET'])
def get_policy_change(id):
    policy_change = PolicyChange.query.get_or_404(id)
    return jsonify({
        "id": policy_change.id,
        "policy_document_id": policy_change.policy_document_id,
        "previous_version": policy_change.previous_version,
        "new_version": policy_change.new_version,
        "change_summary": policy_change.change_summary
    })

@policy_change_bp.route('/policy_changes/<int:id>', methods=['PUT'])
def update_policy_change(id):
    policy_change = PolicyChange.query.get_or_404(id)
    data = request.json
    policy_change.previous_version = data.get('previous_version', policy_change.previous_version)
    policy_change.new_version = data.get('new_version', policy_change.new_version)
    policy_change.change_summary = data.get('change_summary', policy_change.change_summary)
    db.session.commit()
    return jsonify({"message": "Policy change updated", "id": policy_change.id})

@policy_change_bp.route('/policy_changes/<int:id>', methods=['DELETE'])
def delete_policy_change(id):
    policy_change = PolicyChange.query.get_or_404(id)
    db.session.delete(policy_change)
    db.session.commit()
    return jsonify({"message": "Policy change deleted"})
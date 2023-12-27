from flask import Blueprint, request, jsonify
from app.models import Product, db 

product_bp = Blueprint('product_bp', __name__)

@product_bp.route('/products', methods=['POST'])
def add_product():
    data = request.json
    new_product = Product(name=data['name'], description=data.get('description'), company_id=data['company_id'])
    db.session.add(new_product)
    db.session.commit()
    return jsonify({"message": "Product added", "id": new_product.id}), 201

@product_bp.route('/products', methods=['GET'])
def get_products():
    products = Product.query.all()
    return jsonify([{"id": product.id, "name": product.name, "description": product.description, "company_id": product.company_id} for product in products])

@product_bp.route('/products/<int:id>', methods=['GET'])
def get_product(id):
    product = Product.query.get_or_404(id)
    return jsonify({"id": product.id, "name": product.name, "description": product.description, "company_id": product.company_id})

@product_bp.route('/products/<int:id>', methods=['PUT'])
def update_product(id):
    product = Product.query.get_or_404(id)
    data = request.json
    product.name = data.get('name', product.name)
    product.description = data.get('description', product.description)
    product.company_id = data.get('company_id', product.company_id)
    db.session.commit()
    return jsonify({"message": "Product updated", "id": product.id})

@product_bp.route('/products/<int:id>', methods=['DELETE'])
def delete_product(id):
    product = Product.query.get_or_404(id)
    db.session.delete(product)
    db.session.commit()
    return jsonify({"message": "Product deleted"})
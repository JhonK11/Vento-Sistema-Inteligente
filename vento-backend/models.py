from sqlalchemy import Column, Integer, String, Float, Boolean, Text, BigInteger
from database import Base

class Producto(Base):
    __tablename__ = "productos"

    id_producto = Column(BigInteger, primary_key=True, index=True)
    sku = Column(String(50), unique=True, index=True)
    codigo_barras = Column(String(50), unique=True, nullable=True)
    nombre = Column(String(150), index=True)
    descripcion = Column(Text, nullable=True)
    imagen_url = Column(String(255), nullable=True)
    id_categoria = Column(BigInteger, index=True)
    id_marca = Column(BigInteger, index=True, nullable=True)
    modelo = Column(String(80), nullable=True)
    id_unidad = Column(BigInteger)
    peso_kg = Column(Float, nullable=True)
    volumen_m3 = Column(Float, nullable=True)
    requiere_lote = Column(Boolean, default=False)
    requiere_vencimiento = Column(Boolean, default=False)
    estado = Column(String(20), default='ACTIVO', index=True)

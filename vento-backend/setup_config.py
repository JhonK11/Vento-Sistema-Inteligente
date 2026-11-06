from database import engine, SessionLocal
from sqlalchemy import text

db = SessionLocal()
db.execute(text('''
CREATE TABLE IF NOT EXISTS configuracion (
    clave VARCHAR(50) PRIMARY KEY,
    valor VARCHAR(255) NOT NULL,
    descripcion VARCHAR(255)
)
'''))

db.execute(text('''
INSERT IGNORE INTO configuracion (clave, valor, descripcion) VALUES 
('tasa_igv', '18.00', 'Tasa de impuestos (%)'), 
('moneda_defecto', 'PEN', 'Moneda por defecto'), 
('nombre_empresa', 'VENTO S.A.C.', 'Nombre de la empresa para reportes')
'''))

db.commit()
print("Configuracion OK")


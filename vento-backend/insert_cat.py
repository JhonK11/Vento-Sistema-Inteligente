from database import engine
from sqlalchemy import text

conn = engine.connect()
conn.execute(text("INSERT IGNORE INTO categorias (nombre, estado) VALUES ('Tecnología', 1), ('Hogar', 1), ('Belleza', 1), ('Deportes', 1), ('Alimentos', 1)"))
conn.commit()
print("Categorias insertadas")

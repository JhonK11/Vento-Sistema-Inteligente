
import pymysql
conn = pymysql.connect(host='localhost',user='root',password='nikobrenda232',database='vento')
cur = conn.cursor()
cur.execute('SHOW CREATE PROCEDURE sp_registrar_compra;')
print(cur.fetchone()[2])
cur.execute('DESCRIBE compras;')
print([(r[0], r[1]) for r in cur.fetchall()])


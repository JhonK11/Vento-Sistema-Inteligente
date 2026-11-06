
import pymysql
conn = pymysql.connect(host='localhost',user='root',password='nikobrenda232',database='vento')
cur = conn.cursor()
for v in ['v_clasificacion_abc_vigente', 'v_stock_disponible', 'v_ventas_diarias']:
    cur.execute(f'DESCRIBE {v};')
    print(f'-- {v} --')
    print([(r[0], r[1]) for r in cur.fetchall()])


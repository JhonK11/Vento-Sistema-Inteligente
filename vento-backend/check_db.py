
import pymysql
conn = pymysql.connect(host='localhost',user='root',password='nikobrenda232',database='vento')
cur = conn.cursor()
cur.execute('SHOW TABLES;')
print([r[0] for r in cur.fetchall()])


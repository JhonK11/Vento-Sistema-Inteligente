import pymysql

try:
    conn = pymysql.connect(host='localhost', user='root', password='nikobrenda232', database='vento')
    cursor = conn.cursor()

    cursor.execute('DROP PROCEDURE IF EXISTS sp_registrar_compra')
    
    sp_sql = '''
    CREATE PROCEDURE sp_registrar_compra(
        IN p_numero_compra VARCHAR(30),
        IN p_id_proveedor BIGINT,
        IN p_id_orden_compra BIGINT,
        IN p_id_usuario BIGINT,
        IN p_id_almacen BIGINT,
        IN p_moneda CHAR(3),
        IN p_tipo_cambio DECIMAL(10,5),
        IN p_descuento DECIMAL(14,2),
        IN p_impuesto DECIMAL(14,2),
        IN p_detalle_json JSON,
        OUT p_id_compra BIGINT
    )
    BEGIN
        DECLARE v_subtotal DECIMAL(14,2) DEFAULT 0;
        DECLARE v_total DECIMAL(14,2) DEFAULT 0;
        DECLARE v_id_producto BIGINT;
        DECLARE v_id_lote BIGINT;
        DECLARE v_cantidad DECIMAL(14,3);
        DECLARE v_costo DECIMAL(14,4);
        DECLARE v_costo_unitario_pen DECIMAL(14,4);
        DECLARE v_stock_actual DECIMAL(14,3);
        DECLARE v_costo_prom_actual DECIMAL(14,4);
        DECLARE v_nuevo_costo_prom DECIMAL(14,4);
        DECLARE v_done INT DEFAULT 0;

        DECLARE cur CURSOR FOR
            SELECT jt.id_producto, jt.id_lote, jt.cantidad, jt.costo_unitario
            FROM JSON_TABLE(p_detalle_json, '$[*]' COLUMNS (
                id_producto     BIGINT PATH '$.id_producto',
                id_lote         BIGINT PATH '$.id_lote',
                cantidad        DECIMAL(14,3) PATH '$.cantidad',
                costo_unitario  DECIMAL(14,4) PATH '$.costo_unitario'
            )) AS jt;

        DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_done = 1;
        DECLARE EXIT HANDLER FOR SQLEXCEPTION
        BEGIN
            ROLLBACK;
            RESIGNAL;
        END;

        -- Calcular Subtotal desde el JSON
        SELECT SUM(jt.cantidad * jt.costo_unitario) INTO v_subtotal
        FROM JSON_TABLE(p_detalle_json, '$[*]' COLUMNS (
            cantidad        DECIMAL(14,3) PATH '$.cantidad',
            costo_unitario  DECIMAL(14,4) PATH '$.costo_unitario'
        )) AS jt;
        
        IF v_subtotal IS NULL THEN
            SET v_subtotal = 0;
        END IF;
        
        SET v_total = v_subtotal - p_descuento + p_impuesto;

        START TRANSACTION;

        -- 1. Insertar Cabecera de Compra
        INSERT INTO compras (
            numero_compra, id_proveedor, id_usuario, id_almacen_destino, 
            fecha, moneda, tipo_cambio, subtotal, total, estado
        ) VALUES (
            p_numero_compra, p_id_proveedor, p_id_usuario, p_id_almacen, 
            NOW(), p_moneda, p_tipo_cambio, v_subtotal, v_total, 'RECIBIDA'
        );
        
        SET p_id_compra = LAST_INSERT_ID();

        -- 2. Iterar sobre el cursor de detalles
        OPEN cur;
        read_loop: LOOP
            FETCH cur INTO v_id_producto, v_id_lote, v_cantidad, v_costo;
            IF v_done THEN
                LEAVE read_loop;
            END IF;
            
            -- Convertir costo a PEN si es USD
            IF p_moneda = 'USD' THEN
                SET v_costo_unitario_pen = v_costo * p_tipo_cambio;
            ELSE
                SET v_costo_unitario_pen = v_costo;
            END IF;

            -- Insertar Detalle
            INSERT INTO compras_detalle (id_compra, id_producto, cantidad, costo_unitario)
            VALUES (p_id_compra, v_id_producto, v_cantidad, v_costo);
            
            -- Calcular Costo Promedio Ponderado en base a stock pre-compra
            SELECT IFNULL(SUM(stock_actual), 0) INTO v_stock_actual
            FROM inventario WHERE id_producto = v_id_producto;
            
            SELECT costo_promedio_pen INTO v_costo_prom_actual
            FROM productos WHERE id_producto = v_id_producto;
            
            IF (v_stock_actual + v_cantidad) > 0 THEN
                SET v_nuevo_costo_prom = ((v_stock_actual * v_costo_prom_actual) + (v_cantidad * v_costo_unitario_pen)) / (v_stock_actual + v_cantidad);
            ELSE
                SET v_nuevo_costo_prom = v_costo_unitario_pen;
            END IF;

            -- Actualizar costo promedio en producto
            UPDATE productos SET costo_promedio_pen = v_nuevo_costo_prom WHERE id_producto = v_id_producto;

            -- Actualizar Historial de Precios
            INSERT INTO historial_precios (id_producto, tipo_precio, valor, fecha_inicio, id_usuario, motivo)
            VALUES (v_id_producto, 'COSTO', v_nuevo_costo_prom, NOW(), p_id_usuario, CONCAT('Compra ', p_numero_compra));
            
            -- Registrar Movimiento de Inventario Kardex (el trigger trg_movinv_before_insert actualiza el inventario)
            INSERT INTO movimientos_inventario (
                id_producto, id_almacen, id_lote, tipo_movimiento, cantidad, 
                stock_anterior, stock_posterior, costo_unitario, fecha, id_usuario, referencia_tipo, referencia_id
            ) VALUES (
                v_id_producto, p_id_almacen, v_id_lote, 'COMPRA', v_cantidad, 
                0, 0, v_costo_unitario_pen, NOW(), p_id_usuario, 'COMPRA', p_id_compra
            );

        END LOOP;
        CLOSE cur;

        COMMIT;
    END
    '''
    
    cursor.execute(sp_sql)
    conn.commit()
    print("Stored procedure sp_registrar_compra updated successfully with JSON_TABLE.")
except Exception as e:
    print('Error:', e)

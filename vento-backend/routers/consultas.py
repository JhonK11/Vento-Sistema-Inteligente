import time
import requests
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional
from database import get_db
from routers.auth import get_current_user

router = APIRouter(
    prefix="/api/consultas",
    tags=["Consultas Externas (SUNAT / RENIEC / Tipo de Cambio)"],
    dependencies=[Depends(get_current_user)]
)

# Cache en memoria para Tipo de Cambio (evita peticiones innecesarias)
_tc_cache = {
    "timestamp": 0,
    "data": None
}

@router.get("/tipo-cambio")
def obtener_tipo_cambio_sunat():
    """
    Obtiene el tipo de cambio oficial de SUNAT en tiempo real (Compra / Venta).
    Implementa caché en memoria de 30 minutos y fallback seguro en caso de corte de internet.
    """
    global _tc_cache
    now = time.time()

    # Si hay caché válido (menos de 30 minutos = 1800s), retornarlo
    if _tc_cache["data"] and (now - _tc_cache["timestamp"] < 1800):
        return {**_tc_cache["data"], "cached": True}

    # 1. Intentar API primaria SUNAT (apis.net.pe)
    try:
        url = "https://api.apis.net.pe/v1/tipo-cambio-sunat"
        res = requests.get(url, timeout=4, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
        if res.status_code == 200:
            data = res.json()
            tc_data = {
                "origen": data.get("origen", "SUNAT"),
                "moneda": "USD",
                "fecha": data.get("fecha", ""),
                "compra": float(data.get("compra", 3.75)),
                "venta": float(data.get("venta", 3.77)),
                "fuente": "SUNAT Oficial (En Línea)",
                "online": True
            }
            _tc_cache["timestamp"] = now
            _tc_cache["data"] = tc_data
            return {**tc_data, "cached": False}
    except Exception:
        pass

    # 2. Intentar API secundaria (Open Exchange Rates fallback)
    try:
        url_sec = "https://open.er-api.com/v6/latest/USD"
        res = requests.get(url_sec, timeout=4)
        if res.status_code == 200:
            data = res.json()
            rate = float(data.get("rates", {}).get("PEN", 3.75))
            tc_data = {
                "origen": "Mercado Interbancario",
                "moneda": "USD",
                "fecha": data.get("time_last_update_utc", "")[:10],
                "compra": round(rate - 0.015, 3),
                "venta": round(rate + 0.015, 3),
                "fuente": "Mercado Cambiario Internacional",
                "online": True
            }
            _tc_cache["timestamp"] = now
            _tc_cache["data"] = tc_data
            return {**tc_data, "cached": False}
    except Exception:
        pass

    # 3. Fallback Seguro Offline si no hay conexión a internet
    if _tc_cache["data"]:
        return {**_tc_cache["data"], "fuente": "Último registro guardado (Offline)", "online": False}

    return {
        "origen": "SUNAT",
        "moneda": "USD",
        "fecha": time.strftime("%Y-%m-%d"),
        "compra": 3.750,
        "venta": 3.770,
        "fuente": "Referencial Estándar (Offline)",
        "online": False,
        "cached": False
    }

@router.get("/ruc/{numero_ruc}")
def consultar_ruc_sunat(numero_ruc: str):
    """
    Consulta en tiempo real los datos tributarios oficiales de un RUC a través de SUNAT.
    Devuelve Razón Social, Estado (ACTIVO), Condición (HABIDO) y Dirección Fiscal.
    """
    numero = numero_ruc.strip()
    if len(numero) != 11 or not numero.isdigit():
        raise HTTPException(status_code=400, detail="El RUC debe tener exactamente 11 dígitos numéricos.")

    if not (numero.startswith("10") or numero.startswith("20") or numero.startswith("15") or numero.startswith("17")):
        raise HTTPException(status_code=400, detail="El RUC ingresado no posee un formato válido de SUNAT (debe iniciar con 10, 20, 15 o 17).")

    try:
        url = f"https://api.apis.net.pe/v1/ruc?numero={numero}"
        res = requests.get(url, timeout=10, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
        if res.status_code == 200:
            data = res.json()
            return {
                "tipo_documento": "RUC",
                "numero_documento": numero,
                "nombre_razon_social": data.get("nombre", "").strip(),
                "estado": data.get("estado", "ACTIVO").strip(),
                "condicion": data.get("condicion", "HABIDO").strip(),
                "direccion": data.get("direccion", "").strip() or None,
                "departamento": data.get("departamento", "").strip() or None,
                "provincia": data.get("provincia", "").strip() or None,
                "distrito": data.get("distrito", "").strip() or None,
                "es_valido": True
            }
        elif res.status_code == 404:
            raise HTTPException(status_code=404, detail="El RUC no fue encontrado en los padrones de SUNAT.")
        else:
            raise HTTPException(status_code=502, detail="No se pudo obtener respuesta del servicio de SUNAT.")
    except HTTPException:
        raise
    except requests.exceptions.Timeout:
        raise HTTPException(status_code=504, detail="Tiempo de espera agotado al consultar SUNAT. Revisa tu conexión.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error en consulta de RUC: {str(e)}")

@router.get("/dni/{numero_dni}")
def consultar_dni_reniec(numero_dni: str):
    """
    Consulta en tiempo real la identidad de un ciudadano ante RENIEC.
    Devuelve Nombres, Apellido Paterno, Apellido Materno y Nombre Completo.
    """
    numero = numero_dni.strip()
    if len(numero) != 8 or not numero.isdigit():
        raise HTTPException(status_code=400, detail="El DNI debe tener exactamente 8 dígitos numéricos.")

    try:
        url = f"https://api.apis.net.pe/v1/dni?numero={numero}"
        res = requests.get(url, timeout=10, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
        if res.status_code == 200:
            data = res.json()
            nombres = data.get("nombres", "").strip()
            ape_pat = data.get("apellidoPaterno", "").strip()
            ape_mat = data.get("apellidoMaterno", "").strip()
            nombre_completo = data.get("nombre", "").strip()

            if not nombre_completo and (nombres or ape_pat):
                nombre_completo = f"{nombres} {ape_pat} {ape_mat}".strip()

            return {
                "tipo_documento": "DNI",
                "numero_documento": numero,
                "nombre_razon_social": nombre_completo,
                "nombres": nombres,
                "apellido_paterno": ape_pat,
                "apellido_materno": ape_mat,
                "es_valido": True
            }
        elif res.status_code == 404:
            raise HTTPException(status_code=404, detail="El DNI no fue encontrado en los padrones de RENIEC.")
        else:
            raise HTTPException(status_code=502, detail="No se pudo obtener respuesta del servicio de RENIEC.")
    except HTTPException:
        raise
    except requests.exceptions.Timeout:
        raise HTTPException(status_code=504, detail="Tiempo de espera agotado al consultar RENIEC. Revisa tu conexión.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error en consulta de DNI: {str(e)}")

@router.post("/clientes/guardar-o-buscar")
def guardar_o_buscar_cliente_rapido(
    tipo_documento: str = Query(..., pattern="^(DNI|RUC|CE|PASAPORTE)$"),
    numero_documento: str = Query(...),
    nombre_razon_social: str = Query(...),
    direccion: Optional[str] = Query(None),
    telefono: Optional[str] = Query(None),
    email: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Busca si el cliente ya existe por su documento. Si no existe, lo inserta en la base de datos 
    y devuelve su id_cliente para asignarlo inmediatamente a la venta en el POS.
    """
    num = numero_documento.strip()
    nom = nombre_razon_social.strip()

    # Buscar existente
    existente = db.execute(
        text("SELECT id_cliente, nombre_razon_social, numero_documento FROM clientes WHERE tipo_documento = :td AND numero_documento = :nd"),
        {"td": tipo_documento, "nd": num}
    ).mappings().first()

    if existente:
        return {
            "status": "success",
            "message": "Cliente ya registrado",
            "id_cliente": existente["id_cliente"],
            "nombre_razon_social": existente["nombre_razon_social"],
            "nuevo": False
        }

    # Insertar nuevo cliente
    insert_query = text("""
        INSERT INTO clientes (tipo_documento, numero_documento, nombre_razon_social, direccion, telefono, email, estado)
        VALUES (:td, :nd, :nom, :dir, :tel, :em, 1)
    """)
    db.execute(insert_query, {
        "td": tipo_documento,
        "nd": num,
        "nom": nom,
        "dir": direccion,
        "tel": telefono,
        "em": email
    })
    db.commit()

    nuevo = db.execute(
        text("SELECT id_cliente, nombre_razon_social FROM clientes WHERE tipo_documento = :td AND numero_documento = :nd"),
        {"td": tipo_documento, "nd": num}
    ).mappings().first()

    return {
        "status": "success",
        "message": "Cliente registrado exitosamente",
        "id_cliente": nuevo["id_cliente"],
        "nombre_razon_social": nuevo["nombre_razon_social"],
        "nuevo": True
    }

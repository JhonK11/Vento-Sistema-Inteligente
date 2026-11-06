"""Pronósticos sobre ventas observadas y una política común de reposición."""
from datetime import date, datetime, timedelta, timezone
from math import ceil, sqrt
from statistics import NormalDist
import warnings

import numpy as np
import pandas as pd


def fecha_corte_local() -> date:
    # Solo días completos; no depender de la zona horaria del servidor MySQL.
    return datetime.now(timezone(timedelta(hours=-5))).date() - timedelta(days=1)


def serie_diaria(ventas, fecha_inicio: date, fecha_corte: date) -> pd.Series:
    inicio = max(fecha_inicio, fecha_corte - timedelta(days=364))
    if inicio > fecha_corte:
        return pd.Series(dtype=float)
    serie = pd.Series(0.0, index=pd.date_range(inicio, fecha_corte, freq="D"))
    for venta in ventas:
        fecha = pd.Timestamp(venta["fecha"])
        if fecha in serie.index:
            serie.loc[fecha] += float(venta["cantidad"])
    return serie


def pronosticar(serie: pd.Series, horizonte: int, nivel_servicio: float):
    """Con poca información, usar la media observada sin inventar historial."""
    dias_con_ventas = int((serie > 0).sum())
    calidad = "SIN_VENTAS" if dias_con_ventas == 0 else "LIMITADO"
    media = float(serie.tail(30).mean()) if len(serie) else 0.0
    desviacion = float(serie.tail(30).std(ddof=0)) if len(serie) else 0.0
    preds = np.full(horizonte, media)
    intervalo_z = NormalDist().inv_cdf((1 + nivel_servicio) / 2)
    inferior = np.maximum(0, preds - intervalo_z * desviacion)
    superior = preds + intervalo_z * desviacion
    metodo = "Media diaria observada (historial limitado)" if dias_con_ventas else "Sin ventas observadas"
    if len(serie) >= 28 and dias_con_ventas >= 7:
        calidad = "SUFICIENTE"
        try:
            from statsmodels.tsa.arima.model import ARIMA
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                ajuste = ARIMA(serie, order=(1, 1, 1)).fit()
            if not ajuste.mle_retvals.get("converged", False):
                raise ValueError("El modelo no convergió")
            resultado = ajuste.get_forecast(steps=horizonte)
            valores = np.asarray(resultado.predicted_mean, dtype=float)
            intervalos = np.asarray(resultado.conf_int(alpha=1 - nivel_servicio), dtype=float)
            if not np.isfinite(valores).all() or not np.isfinite(intervalos).all():
                raise ValueError("Pronóstico no finito")
            preds = np.maximum(0, valores)
            inferior = np.maximum(0, np.minimum(intervalos[:, 0], preds))
            superior = np.maximum(preds, intervalos[:, 1])
            metodo = "ARIMA(1,1,1)"
        except (ValueError, RuntimeError, np.linalg.LinAlgError):
            metodo = "Media diaria observada (ARIMA no disponible)"
    return {
        "valores": preds, "inferior": inferior, "superior": superior,
        "algoritmo": metodo, "calidad": calidad, "dias_historial": len(serie),
        "dias_con_ventas": dias_con_ventas, "desviacion": desviacion,
    }


def politica_reposicion(demanda: float, desviacion: float, lead_time: int,
                        stock_disponible: float, costo: float | None,
                        nivel_servicio: float = 0.95, cobertura_dias: int = 20):
    demanda = max(0.0, demanda)
    stock = max(0.0, stock_disponible)
    ss = NormalDist().inv_cdf(nivel_servicio) * sqrt(max(0, lead_time)) * max(0.0, desviacion)
    rop = demanda * max(0, lead_time) + ss
    cantidad = max(0, ceil(rop + demanda * cobertura_dias - stock)) if demanda > 0 and stock <= rop else 0
    cobertura = round(stock / demanda, 1) if demanda > 0 else None
    if demanda <= 0:
        estado, color, mensaje = "SIN_DEMANDA", "slate", "Sin ventas suficientes para recomendar una compra automática."
    elif stock <= 0:
        estado, color, mensaje = "AGOTADO", "red", "No hay stock disponible para atender la demanda."
    elif stock <= ss:
        estado, color, mensaje = "CRITICO", "red", "Stock disponible por debajo del nivel de seguridad."
    elif stock <= rop:
        estado, color, mensaje = "REORDEN", "amber", "Se alcanzó el punto de reorden; revisa la propuesta de compra."
    elif cobertura > 60:
        estado, color, mensaje = "SOBRESTOCK", "purple", "Más de 60 días de cobertura de ventas estimadas."
    else:
        estado, color, mensaje = "OPTIMO", "emerald", "Stock disponible superior al punto de reorden."
    costo_conocido = costo is not None and costo > 0
    return {
        "stock_seguridad": round(ss, 1), "punto_reorden": round(rop, 1),
        "estado": estado, "color": color, "mensaje": mensaje,
        "cantidad_sugerida_compra": cantidad,
        "inversion_estimada_pen": round(cantidad * costo, 2) if costo_conocido else None,
        "costo_conocido": costo_conocido, "dias_cobertura": cobertura,
    }

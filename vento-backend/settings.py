"""Configuración de firma: clave externa o clave local persistida fuera del código."""
import os
from pathlib import Path
import secrets

BASE_DIR = Path(__file__).resolve().parent
try:
    from dotenv import load_dotenv
except ImportError:
    pass  # Las variables del proceso siguen funcionando en entornos mínimos.
else:
    load_dotenv(BASE_DIR / '.env')


def jwt_secret() -> str:
    configured = os.getenv('SECRET_KEY', '').strip()
    if configured:
        if len(configured) < 32 or configured == 'vento_super_secret_key_2026_secure_32_bytes':
            raise RuntimeError('SECRET_KEY debe ser una clave privada nueva de al menos 32 caracteres.')
        return configured
    # Desarrollo local: conservar sesiones entre reinicios sin usar una clave pública.
    # En despliegues con varias réplicas, todas deben recibir la misma SECRET_KEY.
    path = BASE_DIR / '.jwt-secret'
    try:
        descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    except FileExistsError:
        pass
    else:
        with os.fdopen(descriptor, 'w', encoding='utf-8') as stream:
            stream.write(secrets.token_urlsafe(48))
    secret = path.read_text(encoding='utf-8').strip()
    if len(secret) < 32:
        raise RuntimeError('La clave JWT local es inválida. Configura SECRET_KEY antes de iniciar.')
    return secret

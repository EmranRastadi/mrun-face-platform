import logging

import consul

from .config import settings


def get_logger(name: str) -> logging.Logger:
    logging.basicConfig(
        level=settings.log_level,
        format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    )
    return logging.getLogger(name)


class ConsulClient:
    def __init__(self) -> None:
        self.client = consul.Consul(
            host=settings.consul_host,
            port=settings.consul_port,
        )

    def register_service(self, name: str, service_id: str, address: str, port: int) -> None:
        self.client.agent.service.register(
            name=name,
            service_id=service_id,
            address=address,
            port=port,
            check=consul.Check.http(
                f"http://{address}:{port}/health",
                interval="10s",
                timeout="5s",
            ),
        )

    def deregister_service(self, service_id: str) -> None:
        self.client.agent.service.deregister(service_id)


consul_client = ConsulClient()

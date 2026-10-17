import consul
import logging
from .config import settings

def get_logger(name: str):
        logging.basicConfig(
            level=logging.INFO,
            format="%(asctime)s | %(levelname)s | %(name)s | %(message)s"
        )
        return logging.getLogger(name)
class ConsulClient:

    def __init__(self):
        self.client = consul.Consul(
            host=settings.consul_host,
            port=settings.consul_port
        )

    def register_service(self, name, service_id, address, port):

        self.client.agent.service.register(
            name=name,
            service_id=service_id,
            address=address,
            port=port,
            check={
                "HTTP": f"http://{address}:{port}/health",
                "Interval": "10s",
                "Timeout": "5s",
                # Auto-remove stale instances (killed pods that never deregistered).
                "DeregisterCriticalServiceAfter": "5m",
            },
        )


    def get_all_services(self):
        _, services = self.client.catalog.services()
        return services

    def get_service(self, name):
        _, services = self.client.health.service(name, passing=True)

        if not services:
            return None

        service = services[0]["Service"]

        return service

    def deregister_service(self, service_id):
        self.client.agent.service.deregister(service_id)


consul_client = ConsulClient()
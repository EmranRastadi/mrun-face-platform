import logging

try:
    import consul
except ImportError:
    consul = None


def get_logger(name: str):
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    )
    return logging.getLogger(name)


class ConsulClient:
    def __init__(self):
        self.client = None

        if consul:
            try:
                self.client = consul.Consul(host="localhost", port=8500)
            except Exception:
                self.client = None

    def register_service(
        self,
        name: str,
        port: int,
        address: str = "localhost",
        tags=None,
    ):
        if not self.client:
            return

        self.client.agent.service.register(
            name=name,
            service_id=name,
            address=address,
            port=port,
            tags=tags or [],
        )

    def get_all_services(self):
        if not self.client:
            return {}

        _, services = self.client.agent.services()
        return services

    def get_service(self, name: str):
        if not self.client:
            return None

        _, services = self.client.health.service(name, passing=True)

        if not services:
            return None

        service = services[0]["Service"]

        return {
            "ID": service["ID"],
            "Service": service["Service"],
            "Address": service["Address"],
            "Port": service["Port"],
            "Tags": service.get("Tags", []),
        }


consul_client = ConsulClient()
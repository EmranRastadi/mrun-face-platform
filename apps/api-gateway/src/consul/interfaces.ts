export interface ConsulConfig {
    host: string;
    port: number;
}

export interface RegisterServiceDto {
    ID: string;
    Name: string;
    Address: string;
    Port: number;

    Check: {
        HTTP: string;
        Interval: string;
        Timeout: string;
    };
}
import { ApiProperty } from '@nestjs/swagger';

import { ServiceProviderKategorie, ServiceProviderTarget } from '../domain/service-provider.enum.js';
import { ServiceProvider } from '../domain/service-provider.js';

export class ServiceProviderResponse {
    @ApiProperty()
    public id: string;

    @ApiProperty()
    public name: string;

    @ApiProperty({ enum: ServiceProviderTarget, enumName: 'ServiceProviderTarget' })
    public target: ServiceProviderTarget;

    @ApiProperty({ description: 'Can be undefined, if `target` is not equal to `URL`' })
    public url?: string;

    @ApiProperty({ enum: ServiceProviderKategorie, enumName: 'ServiceProviderKategorie' })
    public kategorie: ServiceProviderKategorie;

    @ApiProperty()
    public hasLogo: boolean;

    public constructor(serviceProvider: ServiceProvider<true>) {
        this.id = serviceProvider.id;
        this.name = serviceProvider.name;
        this.target = serviceProvider.target;
        this.url = serviceProvider.url;
        this.kategorie = serviceProvider.kategorie;
        this.hasLogo = !!serviceProvider.logoMimeType; // serviceProvider.logo might not be loaded, so just check the mime-type
    }
}

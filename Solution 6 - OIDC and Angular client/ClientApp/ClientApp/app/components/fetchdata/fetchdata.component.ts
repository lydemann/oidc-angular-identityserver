import { Component, Inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../core/auth.service';

@Component({
    selector: 'fetchdata',
    templateUrl: './fetchdata.component.html'
})
export class FetchDataComponent {
    public forecasts: WeatherForecast[] = [];

    constructor(authService: AuthService, @Inject('API_URL') apiUrl: string) {
        authService.get(apiUrl + 'api/SampleData/WeatherForecasts').subscribe(result => {
            this.forecasts = result as WeatherForecast[];
        }, error => console.error(error));
    }
}

interface WeatherForecast {
    dateFormatted: string;
    temperatureC: number;
    temperatureF: number;
    summary: string;
}

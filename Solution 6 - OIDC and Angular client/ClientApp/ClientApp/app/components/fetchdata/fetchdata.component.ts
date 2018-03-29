import { Component, Inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../core/auth.service';
import { OnInit } from '@angular/core/src/metadata/lifecycle_hooks';

@Component({
    selector: 'fetchdata',
    templateUrl: './fetchdata.component.html'
})
export class FetchDataComponent implements OnInit {
    public forecasts: WeatherForecast[] = [];

    constructor(private authService: AuthService, @Inject('API_URL') private apiUrl: string) {
    }

    ngOnInit(): void {
        this.authService.get(this.apiUrl + '/api/SampleData/WeatherForecasts').subscribe(result => {
            this.forecasts = result as WeatherForecast[];
        }, (error) => {
            console.error(error);
        });
    }
}

interface WeatherForecast {
    dateFormatted: string;
    temperatureC: number;
    temperatureF: number;
    summary: string;
}

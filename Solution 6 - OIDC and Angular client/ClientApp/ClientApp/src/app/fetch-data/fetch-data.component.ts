import { Component, Inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AuthService } from 'src/app/core/auth/auth.service';

@Component({
  selector: 'app-fetch-data',
  templateUrl: './fetch-data.component.html'
})
export class FetchDataComponent {
  public forecasts: WeatherForecast[];

  constructor(private authService: AuthService, http: HttpClient, @Inject('API_URL') apiUrl: string) {

    this.authService.get(apiUrl + '/api/SampleData/WeatherForecasts').subscribe(result => {
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

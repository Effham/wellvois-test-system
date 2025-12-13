// Location data for Stripe Connect address forms
// Countries, States/Provinces, and Cities

export interface Country {
  code: string;
  name: string;
}

export interface State {
  code: string;
  name: string;
  countryCode: string;
}

export interface City {
  name: string;
  stateCode: string;
  countryCode: string;
}

// Countries (focusing on Canada and US for Stripe Connect)
export const countries: Country[] = [
  { code: 'CA', name: 'Canada' },
  { code: 'US', name: 'United States' },
];

// US States
export const usStates: State[] = [
  { code: 'AL', name: 'Alabama', countryCode: 'US' },
  { code: 'AK', name: 'Alaska', countryCode: 'US' },
  { code: 'AZ', name: 'Arizona', countryCode: 'US' },
  { code: 'AR', name: 'Arkansas', countryCode: 'US' },
  { code: 'CA', name: 'California', countryCode: 'US' },
  { code: 'CO', name: 'Colorado', countryCode: 'US' },
  { code: 'CT', name: 'Connecticut', countryCode: 'US' },
  { code: 'DE', name: 'Delaware', countryCode: 'US' },
  { code: 'FL', name: 'Florida', countryCode: 'US' },
  { code: 'GA', name: 'Georgia', countryCode: 'US' },
  { code: 'HI', name: 'Hawaii', countryCode: 'US' },
  { code: 'ID', name: 'Idaho', countryCode: 'US' },
  { code: 'IL', name: 'Illinois', countryCode: 'US' },
  { code: 'IN', name: 'Indiana', countryCode: 'US' },
  { code: 'IA', name: 'Iowa', countryCode: 'US' },
  { code: 'KS', name: 'Kansas', countryCode: 'US' },
  { code: 'KY', name: 'Kentucky', countryCode: 'US' },
  { code: 'LA', name: 'Louisiana', countryCode: 'US' },
  { code: 'ME', name: 'Maine', countryCode: 'US' },
  { code: 'MD', name: 'Maryland', countryCode: 'US' },
  { code: 'MA', name: 'Massachusetts', countryCode: 'US' },
  { code: 'MI', name: 'Michigan', countryCode: 'US' },
  { code: 'MN', name: 'Minnesota', countryCode: 'US' },
  { code: 'MS', name: 'Mississippi', countryCode: 'US' },
  { code: 'MO', name: 'Missouri', countryCode: 'US' },
  { code: 'MT', name: 'Montana', countryCode: 'US' },
  { code: 'NE', name: 'Nebraska', countryCode: 'US' },
  { code: 'NV', name: 'Nevada', countryCode: 'US' },
  { code: 'NH', name: 'New Hampshire', countryCode: 'US' },
  { code: 'NJ', name: 'New Jersey', countryCode: 'US' },
  { code: 'NM', name: 'New Mexico', countryCode: 'US' },
  { code: 'NY', name: 'New York', countryCode: 'US' },
  { code: 'NC', name: 'North Carolina', countryCode: 'US' },
  { code: 'ND', name: 'North Dakota', countryCode: 'US' },
  { code: 'OH', name: 'Ohio', countryCode: 'US' },
  { code: 'OK', name: 'Oklahoma', countryCode: 'US' },
  { code: 'OR', name: 'Oregon', countryCode: 'US' },
  { code: 'PA', name: 'Pennsylvania', countryCode: 'US' },
  { code: 'RI', name: 'Rhode Island', countryCode: 'US' },
  { code: 'SC', name: 'South Carolina', countryCode: 'US' },
  { code: 'SD', name: 'South Dakota', countryCode: 'US' },
  { code: 'TN', name: 'Tennessee', countryCode: 'US' },
  { code: 'TX', name: 'Texas', countryCode: 'US' },
  { code: 'UT', name: 'Utah', countryCode: 'US' },
  { code: 'VT', name: 'Vermont', countryCode: 'US' },
  { code: 'VA', name: 'Virginia', countryCode: 'US' },
  { code: 'WA', name: 'Washington', countryCode: 'US' },
  { code: 'WV', name: 'West Virginia', countryCode: 'US' },
  { code: 'WI', name: 'Wisconsin', countryCode: 'US' },
  { code: 'WY', name: 'Wyoming', countryCode: 'US' },
  { code: 'DC', name: 'District of Columbia', countryCode: 'US' },
];

// Canadian Provinces
export const canadianProvinces: State[] = [
  { code: 'AB', name: 'Alberta', countryCode: 'CA' },
  { code: 'BC', name: 'British Columbia', countryCode: 'CA' },
  { code: 'MB', name: 'Manitoba', countryCode: 'CA' },
  { code: 'NB', name: 'New Brunswick', countryCode: 'CA' },
  { code: 'NL', name: 'Newfoundland and Labrador', countryCode: 'CA' },
  { code: 'NS', name: 'Nova Scotia', countryCode: 'CA' },
  { code: 'NT', name: 'Northwest Territories', countryCode: 'CA' },
  { code: 'NU', name: 'Nunavut', countryCode: 'CA' },
  { code: 'ON', name: 'Ontario', countryCode: 'CA' },
  { code: 'PE', name: 'Prince Edward Island', countryCode: 'CA' },
  { code: 'QC', name: 'Quebec', countryCode: 'CA' },
  { code: 'SK', name: 'Saskatchewan', countryCode: 'CA' },
  { code: 'YT', name: 'Yukon', countryCode: 'CA' },
];

// All states/provinces combined
export const allStates: State[] = [...usStates, ...canadianProvinces];

// Cities data - Major cities for Canada and US
export const cities: City[] = [
  // Canadian Cities
  { name: 'Toronto', stateCode: 'ON', countryCode: 'CA' },
  { name: 'Ottawa', stateCode: 'ON', countryCode: 'CA' },
  { name: 'Mississauga', stateCode: 'ON', countryCode: 'CA' },
  { name: 'Brampton', stateCode: 'ON', countryCode: 'CA' },
  { name: 'Hamilton', stateCode: 'ON', countryCode: 'CA' },
  { name: 'London', stateCode: 'ON', countryCode: 'CA' },
  { name: 'Markham', stateCode: 'ON', countryCode: 'CA' },
  { name: 'Vaughan', stateCode: 'ON', countryCode: 'CA' },
  { name: 'Kitchener', stateCode: 'ON', countryCode: 'CA' },
  { name: 'Windsor', stateCode: 'ON', countryCode: 'CA' },
  { name: 'Richmond Hill', stateCode: 'ON', countryCode: 'CA' },
  { name: 'Oakville', stateCode: 'ON', countryCode: 'CA' },
  { name: 'Burlington', stateCode: 'ON', countryCode: 'CA' },
  { name: 'Oshawa', stateCode: 'ON', countryCode: 'CA' },
  { name: 'Barrie', stateCode: 'ON', countryCode: 'CA' },
  { name: 'Montreal', stateCode: 'QC', countryCode: 'CA' },
  { name: 'Quebec City', stateCode: 'QC', countryCode: 'CA' },
  { name: 'Laval', stateCode: 'QC', countryCode: 'CA' },
  { name: 'Gatineau', stateCode: 'QC', countryCode: 'CA' },
  { name: 'Longueuil', stateCode: 'QC', countryCode: 'CA' },
  { name: 'Sherbrooke', stateCode: 'QC', countryCode: 'CA' },
  { name: 'Saguenay', stateCode: 'QC', countryCode: 'CA' },
  { name: 'Lévis', stateCode: 'QC', countryCode: 'CA' },
  { name: 'Trois-Rivières', stateCode: 'QC', countryCode: 'CA' },
  { name: 'Vancouver', stateCode: 'BC', countryCode: 'CA' },
  { name: 'Surrey', stateCode: 'BC', countryCode: 'CA' },
  { name: 'Burnaby', stateCode: 'BC', countryCode: 'CA' },
  { name: 'Richmond', stateCode: 'BC', countryCode: 'CA' },
  { name: 'Kelowna', stateCode: 'BC', countryCode: 'CA' },
  { name: 'Victoria', stateCode: 'BC', countryCode: 'CA' },
  { name: 'Calgary', stateCode: 'AB', countryCode: 'CA' },
  { name: 'Edmonton', stateCode: 'AB', countryCode: 'CA' },
  { name: 'Red Deer', stateCode: 'AB', countryCode: 'CA' },
  { name: 'Lethbridge', stateCode: 'AB', countryCode: 'CA' },
  { name: 'Winnipeg', stateCode: 'MB', countryCode: 'CA' },
  { name: 'Saskatoon', stateCode: 'SK', countryCode: 'CA' },
  { name: 'Regina', stateCode: 'SK', countryCode: 'CA' },
  { name: 'Halifax', stateCode: 'NS', countryCode: 'CA' },
  { name: 'Charlottetown', stateCode: 'PE', countryCode: 'CA' },
  { name: 'St. John\'s', stateCode: 'NL', countryCode: 'CA' },
  { name: 'Fredericton', stateCode: 'NB', countryCode: 'CA' },
  { name: 'Moncton', stateCode: 'NB', countryCode: 'CA' },
  { name: 'Whitehorse', stateCode: 'YT', countryCode: 'CA' },
  { name: 'Yellowknife', stateCode: 'NT', countryCode: 'CA' },
  { name: 'Iqaluit', stateCode: 'NU', countryCode: 'CA' },
  
  // US Cities - Major cities for each state
  { name: 'New York', stateCode: 'NY', countryCode: 'US' },
  { name: 'Los Angeles', stateCode: 'CA', countryCode: 'US' },
  { name: 'Chicago', stateCode: 'IL', countryCode: 'US' },
  { name: 'Houston', stateCode: 'TX', countryCode: 'US' },
  { name: 'Phoenix', stateCode: 'AZ', countryCode: 'US' },
  { name: 'Philadelphia', stateCode: 'PA', countryCode: 'US' },
  { name: 'San Antonio', stateCode: 'TX', countryCode: 'US' },
  { name: 'San Diego', stateCode: 'CA', countryCode: 'US' },
  { name: 'Dallas', stateCode: 'TX', countryCode: 'US' },
  { name: 'San Jose', stateCode: 'CA', countryCode: 'US' },
  { name: 'Austin', stateCode: 'TX', countryCode: 'US' },
  { name: 'Jacksonville', stateCode: 'FL', countryCode: 'US' },
  { name: 'Fort Worth', stateCode: 'TX', countryCode: 'US' },
  { name: 'Columbus', stateCode: 'OH', countryCode: 'US' },
  { name: 'Charlotte', stateCode: 'NC', countryCode: 'US' },
  { name: 'San Francisco', stateCode: 'CA', countryCode: 'US' },
  { name: 'Indianapolis', stateCode: 'IN', countryCode: 'US' },
  { name: 'Seattle', stateCode: 'WA', countryCode: 'US' },
  { name: 'Denver', stateCode: 'CO', countryCode: 'US' },
  { name: 'Washington', stateCode: 'DC', countryCode: 'US' },
  { name: 'Boston', stateCode: 'MA', countryCode: 'US' },
  { name: 'El Paso', stateCode: 'TX', countryCode: 'US' },
  { name: 'Nashville', stateCode: 'TN', countryCode: 'US' },
  { name: 'Detroit', stateCode: 'MI', countryCode: 'US' },
  { name: 'Oklahoma City', stateCode: 'OK', countryCode: 'US' },
  { name: 'Portland', stateCode: 'OR', countryCode: 'US' },
  { name: 'Las Vegas', stateCode: 'NV', countryCode: 'US' },
  { name: 'Memphis', stateCode: 'TN', countryCode: 'US' },
  { name: 'Louisville', stateCode: 'KY', countryCode: 'US' },
  { name: 'Baltimore', stateCode: 'MD', countryCode: 'US' },
  { name: 'Milwaukee', stateCode: 'WI', countryCode: 'US' },
  { name: 'Albuquerque', stateCode: 'NM', countryCode: 'US' },
  { name: 'Tucson', stateCode: 'AZ', countryCode: 'US' },
  { name: 'Fresno', stateCode: 'CA', countryCode: 'US' },
  { name: 'Sacramento', stateCode: 'CA', countryCode: 'US' },
  { name: 'Kansas City', stateCode: 'MO', countryCode: 'US' },
  { name: 'Mesa', stateCode: 'AZ', countryCode: 'US' },
  { name: 'Atlanta', stateCode: 'GA', countryCode: 'US' },
  { name: 'Omaha', stateCode: 'NE', countryCode: 'US' },
  { name: 'Colorado Springs', stateCode: 'CO', countryCode: 'US' },
  { name: 'Raleigh', stateCode: 'NC', countryCode: 'US' },
  { name: 'Virginia Beach', stateCode: 'VA', countryCode: 'US' },
  { name: 'Miami', stateCode: 'FL', countryCode: 'US' },
  { name: 'Oakland', stateCode: 'CA', countryCode: 'US' },
  { name: 'Minneapolis', stateCode: 'MN', countryCode: 'US' },
  { name: 'Tulsa', stateCode: 'OK', countryCode: 'US' },
  { name: 'Cleveland', stateCode: 'OH', countryCode: 'US' },
  { name: 'Wichita', stateCode: 'KS', countryCode: 'US' },
  { name: 'Arlington', stateCode: 'TX', countryCode: 'US' },
];

// Helper functions
export function getStatesByCountry(countryCode: string): State[] {
  return allStates.filter(state => state.countryCode === countryCode);
}

export function getCitiesByState(stateCode: string, countryCode: string): City[] {
  return cities.filter(city => city.stateCode === stateCode && city.countryCode === countryCode);
}

export function getCountryName(countryCode: string): string {
  const country = countries.find(c => c.code === countryCode);
  return country?.name || countryCode;
}

export function getStateName(stateCode: string, countryCode: string): string {
  const state = allStates.find(s => s.code === stateCode && s.countryCode === countryCode);
  return state?.name || stateCode;
}



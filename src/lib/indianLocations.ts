export const INDIAN_STATES = [
  'Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam',
  'Bihar', 'Chandigarh', 'Chhattisgarh', 'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu and Kashmir',
  'Jharkhand', 'Karnataka', 'Kerala', 'Ladakh', 'Lakshadweep', 'Madhya Pradesh',
  'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha',
  'Puducherry', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana',
  'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
] as const;

// Tamil Nadu Commissionerate of Municipal Administration urban local body directory:
// https://www.tnurbantree.tn.gov.in/list-of-municipality-websites-ulb-locator/1000/
// Names are stored as cities/towns, without the local-body suffix.
export const TAMIL_NADU_CITIES = [
  'Adirampattinam', 'Ambasamudram', 'Ambur', 'Arakkonam', 'Arani', 'Aranthangi',
  'Arcot', 'Ariyalur', 'Aruppukottai', 'Attur', 'Avadi', 'Bhavani', 'Bodinayakanur',
  'Chengalpattu', 'Chennai', 'Chidambaram', 'Chinnamanur', 'Coimbatore', 'Colachel',
  'Coonoor', 'Cuddalore', 'Cumbum', 'Devakottai', 'Dharapuram', 'Dharmapuri',
  'Dindigul', 'Edanganasalai', 'Erode', 'Gobichettipalayam', 'Gudalur', 'Gudiyatham',
  'Hosur', 'Idappadi', 'Jayankondam', 'Jolarpet', 'Kadayanallur', 'Kalakadu',
  'Kallakurichi', 'Kancheepuram', 'Kangeyam', 'Karamadai', 'Karaikudi', 'Karumathampatti',
  'Karur', 'Kayalpattinam', 'Keelakarai', 'Kodaikanal', 'Kollankodu', 'Komarapalayam',
  'Koothanallur', 'Kottakuppam', 'Kovilpatti', 'Krishnagiri', 'Kulithalai', 'Kumbakonam',
  'Kundrathur', 'Kuzhithurai', 'Lalgudi', 'Madhuranthagam', 'Madukkarai', 'Madurai',
  'Manamadurai', 'Manapparai', 'Mangadu', 'Mannargudi', 'Maraimalai Nagar',
  'Mayiladuthurai', 'Melur', 'Melvisharam', 'Mettupalayam', 'Mettur', 'Musiri',
  'Nagapattinam', 'Nagercoil', 'Namakkal', 'Nandivaram Guduvancheri', 'Narasingapuram',
  'Nelliayalam', 'Nellikuppam', 'Oddanchatram', 'Padmanabhapuram', 'Palani',
  'Palladam', 'Pallapatti', 'Pallipalayam', 'Panruti', 'Paramakudi', 'Pattukkottai',
  'Perambalur', 'Periyakulam', 'Pernampattu', 'Pollachi', 'Ponneri', 'Poonamallee',
  'Pudukkottai', 'Pugalur', 'Puliangudi', 'Punjaipuliampatti', 'Rajapalayam',
  'Ramanathapuram', 'Rameswaram', 'Ranipet', 'Rasipuram', 'Salem', 'Sankarankoil',
  'Sathiyamangalam', 'Sattur', 'Sengottai', 'Sholingar', 'Sirkali', 'Sivagangai',
  'Sivakasi', 'Srivilliputhur', 'Surandai', 'Tambaram', 'Tenkasi', 'Thanjavur',
  'Tharamangalam', 'Theni', 'Thiruchengode', 'Thirumuruganpoondi', 'Thirunindravur',
  'Thirupathur', 'Thiruthani', 'Thiruthuraipoondi', 'Thiruvathipuram', 'Thiruvarur',
  'Thiruverkadu', 'Thittagudi', 'Thoothukudi', 'Thuraiyur', 'Thuvakudi', 'Tindivanam',
  'Tiruchendur', 'Tiruchirappalli', 'Tirukovilur', 'Tirumangalam', 'Tirunelveli',
  'Tiruppur', 'Tiruvallur', 'Tiruvannamalai', 'Udumalpettai', 'Ulundurpettai',
  'Usilampatti', 'Uthagamandalam', 'Vadalur', 'Valparai', 'Vandavasi', 'Vaniyambadi',
  'Vedaranyam', 'Vellakovil', 'Vellore', 'Vikramasingapuram', 'Villupuram',
  'Virudhachalam', 'Virudhunagar', 'Walajapet',
].sort((a, b) => a.localeCompare(b));

export const CITY_SEARCH_ALIASES: Record<string, string[]> = {
  Chennai: ['madras'],
  Coimbatore: ['kovai'],
  Kancheepuram: ['kanchipuram'],
  Thoothukudi: ['tuticorin'],
  Tiruchirappalli: ['trichy', 'tiruchi'],
  Tirunelveli: ['nellai'],
  Tiruppur: ['tirupur'],
  Uthagamandalam: ['ooty'],
};

export const CITIES_BY_STATE: Record<string, string[]> = {
  'Andaman and Nicobar Islands': ['Port Blair'],
  'Andhra Pradesh': ['Visakhapatnam', 'Vijayawada', 'Guntur', 'Tirupati', 'Nellore', 'Kurnool'],
  'Arunachal Pradesh': ['Itanagar', 'Naharlagun', 'Pasighat'],
  Assam: ['Guwahati', 'Dibrugarh', 'Silchar', 'Jorhat'],
  Bihar: ['Patna', 'Gaya', 'Muzaffarpur', 'Bhagalpur'],
  Chandigarh: ['Chandigarh'],
  Chhattisgarh: ['Raipur', 'Bhilai', 'Bilaspur', 'Durg'],
  'Dadra and Nagar Haveli and Daman and Diu': ['Daman', 'Diu', 'Silvassa'],
  Delhi: ['New Delhi', 'Delhi'],
  Goa: ['Panaji', 'Margao', 'Vasco da Gama'],
  Gujarat: ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Gandhinagar', 'Bhavnagar'],
  Haryana: ['Gurugram', 'Faridabad', 'Panipat', 'Ambala', 'Hisar', 'Rohtak'],
  'Himachal Pradesh': ['Shimla', 'Solan', 'Dharamshala', 'Mandi'],
  'Jammu and Kashmir': ['Srinagar', 'Jammu', 'Anantnag'],
  Jharkhand: ['Ranchi', 'Jamshedpur', 'Dhanbad', 'Bokaro'],
  Karnataka: ['Bengaluru', 'Mysuru', 'Mangaluru', 'Hubballi', 'Belagavi', 'Udupi'],
  Kerala: ['Thiruvananthapuram', 'Kochi', 'Kozhikode', 'Thrissur', 'Kollam', 'Kannur'],
  Ladakh: ['Leh', 'Kargil'],
  Lakshadweep: ['Kavaratti'],
  'Madhya Pradesh': ['Indore', 'Bhopal', 'Jabalpur', 'Gwalior', 'Ujjain'],
  Maharashtra: ['Mumbai', 'Pune', 'Nagpur', 'Nashik', 'Thane', 'Aurangabad', 'Kolhapur'],
  Manipur: ['Imphal', 'Thoubal'],
  Meghalaya: ['Shillong', 'Tura'],
  Mizoram: ['Aizawl', 'Lunglei'],
  Nagaland: ['Kohima', 'Dimapur'],
  Odisha: ['Bhubaneswar', 'Cuttack', 'Rourkela', 'Puri', 'Sambalpur'],
  Puducherry: ['Puducherry', 'Karaikal'],
  Punjab: ['Ludhiana', 'Amritsar', 'Jalandhar', 'Patiala', 'Mohali', 'Bathinda'],
  Rajasthan: ['Jaipur', 'Jodhpur', 'Udaipur', 'Kota', 'Ajmer', 'Bikaner'],
  Sikkim: ['Gangtok', 'Namchi'],
  'Tamil Nadu': TAMIL_NADU_CITIES,
  Telangana: ['Hyderabad', 'Warangal', 'Nizamabad', 'Karimnagar'],
  Tripura: ['Agartala', 'Udaipur'],
  'Uttar Pradesh': ['Lucknow', 'Kanpur', 'Noida', 'Ghaziabad', 'Varanasi', 'Agra', 'Prayagraj', 'Meerut'],
  Uttarakhand: ['Dehradun', 'Haridwar', 'Roorkee', 'Haldwani'],
  'West Bengal': ['Kolkata', 'Howrah', 'Siliguri', 'Durgapur', 'Asansol'],
};

const STATE_ALIASES: Record<string, string> = {
  'nct of delhi': 'Delhi',
  'national capital territory of delhi': 'Delhi',
  orissa: 'Odisha',
  pondicherry: 'Puducherry',
  uttaranchal: 'Uttarakhand',
};

export function normalizeIndianState(value: string): string {
  const trimmed = value.trim();
  return INDIAN_STATES.find((state) => state.toLowerCase() === trimmed.toLowerCase())
    ?? STATE_ALIASES[trimmed.toLowerCase()]
    ?? trimmed;
}

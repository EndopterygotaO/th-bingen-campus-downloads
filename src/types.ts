export interface Room {
  name?: string | null;
  floor_name?: string;
  room_id: string;
  campus_id: string;
  building_number: number;
  building_name: string;
  aliases: string[];
  mapping_status: string;
}

export interface CampusMap {
  locate(): Promise<void>;
  showBuilding(id: string): Promise<number>;
  overview(): Promise<void>;
  setImagery(enabled: boolean): Promise<void>;
  clear(): void;
  destroy(): void;
}

export interface Facility {
  translations?: Record<string,string>;
  id: string;
  name: string;
  campus_id: string;
  building_name: string;
  aliases: string[];
  description: string;
  source_url: string;
  checked_on: string;
}

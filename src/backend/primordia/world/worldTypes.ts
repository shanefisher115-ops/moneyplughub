export interface WorldEntity {
  type: string;
  name: string;
}

export interface WorldState {
  entities: WorldEntity[];
}

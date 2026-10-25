export class BaseRealm {
  protected name: string;
  protected description: string;

  constructor(name: string, description: string) {
    this.name = name;
    this.description = description;
  }

  public log(message: string): void {
    console.log(`[${this.name}Realm] ${message}`);
  }
}

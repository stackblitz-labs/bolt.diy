export interface CloudflareProject {
  id: string;
  name: string;
  subdomain?: string;
}

export interface CloudflareConnection {
  accountId: string;
  token: string;
  projects?: CloudflareProject[];
}

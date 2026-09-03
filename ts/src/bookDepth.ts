export interface DepthLevel {
  price: number;
  quantity: number;
}

export interface BookDepth {
  bids: DepthLevel[];
  asks: DepthLevel[];
}

import Image from "next/image";

export function MarketFlowBackdrop() {
  return (
    <div className="market-flow-backdrop" aria-hidden="true">
      <div className="market-flow-backdrop__track market-flow-backdrop__track--left">
        <Image
          src="/assets/market-flow-lines.png"
          alt=""
          fill
          loading="eager"
          sizes="70vw"
          draggable={false}
          className="select-none object-contain"
        />
      </div>
      <div className="market-flow-backdrop__track market-flow-backdrop__track--middle">
        <Image
          src="/assets/market-flow-lines.png"
          alt=""
          fill
          sizes="58vw"
          draggable={false}
          className="select-none object-contain"
        />
      </div>
    </div>
  );
}

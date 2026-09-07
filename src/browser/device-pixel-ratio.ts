interface ResolutionQuery {
  addEventListener(
    type: "change",
    listener: () => void,
    options: { readonly once: true },
  ): void;
}

export interface DevicePixelRatioEnvironment {
  readonly devicePixelRatio: number;
  matchMedia(query: string): ResolutionQuery;
}

export function observeDevicePixelRatioChanges(
  environment: DevicePixelRatioEnvironment,
  onChange: () => void,
): void {
  const resolution = environment.matchMedia(
    `(resolution: ${environment.devicePixelRatio}dppx)`,
  );

  resolution.addEventListener(
    "change",
    () => {
      onChange();
      observeDevicePixelRatioChanges(environment, onChange);
    },
    { once: true },
  );
}

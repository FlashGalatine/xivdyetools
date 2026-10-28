import { initPhoton, PhotonImage, SamplingFilter, crop, resize } from '@cf-wasm/photon/others';
import photonModule from '../vendor/photon/photon-owned.wasm';

// One stock JS wrapper instance owns every image and operation in this Worker.
initPhoton.sync({ module: photonModule });

export { PhotonImage, SamplingFilter, crop, resize };

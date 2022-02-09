import { DateTime } from 'apikana/default-types'
import { Pet } from './pet'

export interface PetEvent {
    /**
     * When the event occured.
     */
    timestamp: DateTime

    /**
     * Event field set for an adoption.
     */
    adopted: AdoptedEvent

    /**
     * Event field set when a pet was lost.
     */
    lost: LostEvent
}

export interface AdoptedEvent {
    pet: Pet

    /**
     * Who adopted the pet.
     */
    owner: string
}

export interface LostEvent {
    pet: Pet

    /**
     * Where the pet has been seen the last time.
     */
    location: string
}

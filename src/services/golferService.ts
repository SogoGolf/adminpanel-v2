import { api } from '../api';
import type { Golfer } from '../types';

export const golferService = {
  async getByGolflinkNo(golflinkNo: string): Promise<Golfer | null> {
    return api.golfers.getByGolflinkNo(golflinkNo);
  },

  async getById(id: string): Promise<Golfer | null> {
    return api.golfers.getById(id);
  },

  async searchByName(name: string): Promise<Golfer[]> {
    return api.golfers.searchByName(name);
  },
};

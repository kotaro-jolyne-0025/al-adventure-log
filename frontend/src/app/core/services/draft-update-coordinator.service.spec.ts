import { DraftUpdateCoordinator } from './draft-update-coordinator.service';

describe('DraftUpdateCoordinator', () => {
  it('waits for an active form before allowing an update reload', async () => {
    const coordinator = new DraftUpdateCoordinator();
    const prepare = vi.fn().mockResolvedValue(false);
    const unregister = coordinator.register(prepare);
    expect(await coordinator.prepareReload()).toBe(false);
    expect(prepare).toHaveBeenCalledOnce();
    unregister();
    expect(await coordinator.prepareReload()).toBe(true);
  });

  it('does not unregister a newer active form', async () => {
    const coordinator = new DraftUpdateCoordinator();
    const removeOld = coordinator.register(async () => false);
    const active = vi.fn().mockResolvedValue(true);
    coordinator.register(active);
    removeOld();
    expect(await coordinator.prepareReload()).toBe(true);
    expect(active).toHaveBeenCalledOnce();
  });
});

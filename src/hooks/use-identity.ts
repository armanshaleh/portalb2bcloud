import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyIdentity, type MyIdentity } from "@/lib/identity.functions";

export function useIdentity(initialData?: MyIdentity) {
  const fetchIdentity = useServerFn(getMyIdentity);
  return useQuery<MyIdentity>({
    queryKey: ["identity"],
    queryFn: () => fetchIdentity(),
    initialData,
    staleTime: 5 * 60 * 1000,
  });
}

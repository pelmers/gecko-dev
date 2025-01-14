/* -*- Mode: C++; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 * vim: sw=2 ts=8 et :
 */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "LayerTransactionChild.h"
#include "mozilla/gfx/Logging.h"
#include "mozilla/layers/CompositableClient.h"  // for CompositableChild
#include "mozilla/layers/PCompositableChild.h"  // for PCompositableChild
#include "mozilla/layers/PLayerChild.h"  // for PLayerChild
#include "mozilla/layers/PImageContainerChild.h"
#include "mozilla/layers/ShadowLayers.h"  // for ShadowLayerForwarder
#include "mozilla/mozalloc.h"           // for operator delete, etc
#include "nsDebug.h"                    // for NS_RUNTIMEABORT, etc
#include "nsTArray.h"                   // for nsTArray
#include "mozilla/layers/TextureClient.h"

namespace mozilla {
namespace layers {


void
LayerTransactionChild::Destroy()
{
  if (!IPCOpen()) {
    return;
  }
  // mDestroyed is used to prevent calling Send__delete__() twice.
  // When this function is called from CompositorBridgeChild::Destroy(),
  // under Send__delete__() call, this function is called from
  // ShadowLayerForwarder's destructor.
  // When it happens, IPCOpen() is still true.
  // See bug 1004191.
  mDestroyed = true;
  MOZ_ASSERT(0 == ManagedPLayerChild().Count(),
             "layers should have been cleaned up by now");

  const ManagedContainer<PTextureChild>& textures = ManagedPTextureChild();
  for (auto iter = textures.ConstIter(); !iter.Done(); iter.Next()) {
    RefPtr<TextureClient> texture = TextureClient::AsTextureClient(iter.Get()->GetKey());

    if (texture) {
      texture->Destroy();
    }
  }

  SendShutdown();
}


PLayerChild*
LayerTransactionChild::AllocPLayerChild()
{
  // we always use the "power-user" ctor
  NS_RUNTIMEABORT("not reached");
  return nullptr;
}

bool
LayerTransactionChild::DeallocPLayerChild(PLayerChild* actor)
{
  delete actor;
  return true;
}

PCompositableChild*
LayerTransactionChild::AllocPCompositableChild(const TextureInfo& aInfo)
{
  MOZ_ASSERT(!mDestroyed);
  return CompositableClient::CreateIPDLActor();
}

bool
LayerTransactionChild::DeallocPCompositableChild(PCompositableChild* actor)
{
  return CompositableClient::DestroyIPDLActor(actor);
}

bool
LayerTransactionChild::RecvParentAsyncMessages(InfallibleTArray<AsyncParentMessageData>&& aMessages)
{
  for (AsyncParentMessageArray::index_type i = 0; i < aMessages.Length(); ++i) {
    const AsyncParentMessageData& message = aMessages[i];

    switch (message.type()) {
      case AsyncParentMessageData::TOpDeliverFence: {
        const OpDeliverFence& op = message.get_OpDeliverFence();
        FenceHandle fence = op.fence();
        PTextureChild* child = op.textureChild();

        RefPtr<TextureClient> texture = TextureClient::AsTextureClient(child);
        if (texture) {
          texture->SetReleaseFenceHandle(fence);
        }
        break;
      }
      case AsyncParentMessageData::TOpReplyRemoveTexture: {
        const OpReplyRemoveTexture& op = message.get_OpReplyRemoveTexture();

        AsyncTransactionTrackersHolder::TransactionCompleteted(op.holderId(),
                                                               op.transactionId());
        break;
      }
      default:
        NS_ERROR("unknown AsyncParentMessageData type");
        return false;
    }
  }
  return true;
}

void
LayerTransactionChild::ActorDestroy(ActorDestroyReason why)
{
  mDestroyed = true;
  DestroyAsyncTransactionTrackersHolder();
#ifdef MOZ_B2G
  // Due to poor lifetime management of gralloc (and possibly shmems) we will
  // crash at some point in the future when we get destroyed due to abnormal
  // shutdown. Its better just to crash here. On desktop though, we have a chance
  // of recovering.
  if (why == AbnormalShutdown) {
    NS_RUNTIMEABORT("ActorDestroy by IPC channel failure at LayerTransactionChild");
  }
#endif
}

PTextureChild*
LayerTransactionChild::AllocPTextureChild(const SurfaceDescriptor&,
                                          const LayersBackend&,
                                          const TextureFlags&)
{
  MOZ_ASSERT(!mDestroyed);
  return TextureClient::CreateIPDLActor();
}

bool
LayerTransactionChild::DeallocPTextureChild(PTextureChild* actor)
{
  return TextureClient::DestroyIPDLActor(actor);
}

} // namespace layers
} // namespace mozilla
